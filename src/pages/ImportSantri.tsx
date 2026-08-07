import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Kelas {
  id: string;
  nama: string;
}

interface ParsedRow {
  index: number; // original row number in excel
  nama: string;
  kelas: string;
  kamar: string;
  tempat_lahir: string;
  tanggal_lahir: string; // YYYY-MM-DD
  alamat: string;
  _isValid: boolean;
  _errorMsg: string;
  _kelasId?: string; // Mapped ID
}

const ImportSantri = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [kelasMaster, setKelasMaster] = useState<Kelas[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Preview, 3: Result
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState({ success: 0, failed: 0, failedRows: [] as string[] });

  useEffect(() => {
    // Fetch master kelas for validation
    const fetchKelas = async () => {
      const { data } = await supabase.from('kelas_pengajian').select('id, nama').eq('is_active', true);
      if (data) setKelasMaster(data);
    };
    fetchKelas();
  }, []);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama', 'Kelas', 'Kamar', 'Tempat Lahir', 'Tanggal Lahir (YYYY-MM-DD)', 'Alamat'],
      ['Ahmad Fathan', 'Kelas Ula (Dasar)', 'A-01', 'Bandung', '2005-04-12', 'Jl. Merdeka 1, Bandung']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Santri");
    XLSX.writeFile(wb, "Template_Import_Santri.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length <= 1) {
          alert("File kosong atau tidak memiliki data selain header.");
          return;
        }

        const headers = data[0].map(h => String(h).toLowerCase().trim());
        const rows = data.slice(1).filter(r => r.length > 0 && r.some(cell => cell !== undefined && cell !== null && cell !== '')); // Skip pure empty rows

        const parsed: ParsedRow[] = rows.map((row, idx) => {
          const rawNama = String(row[0] || '').trim();
          const rawKelas = String(row[1] || '').trim();
          const rawKamar = String(row[2] || '').trim();
          const rawTmpLahir = String(row[3] || '').trim();
          
          // Handle Excel date serial numbers if needed, or assume string
          let rawTglLahir = String(row[4] || '').trim();
          if (typeof row[4] === 'number') {
            const dateObj = new Date(Math.round((row[4] - 25569) * 86400 * 1000));
            rawTglLahir = dateObj.toISOString().split('T')[0];
          }

          const rawAlamat = String(row[5] || '').trim();

          let isValid = true;
          let errorMsg = '';
          let matchedKelasId = undefined;

          if (!rawNama) {
            isValid = false;
            errorMsg = 'Nama kosong.';
          } else if (!rawKelas) {
            isValid = false;
            errorMsg = 'Kelas kosong.';
          } else {
            // Fungsi normalisasi: buang kata "kelas", tanda kurung, dan spasi berlebih
            const normalize = (s: string) => s.toLowerCase().replace(/kelas\s*/gi, '').replace(/\(.*?\)/g, '').trim();
            
            // Fungsi similarity sederhana: hitung berapa karakter yang cocok berurutan
            const similarity = (a: string, b: string): number => {
              const shorter = a.length < b.length ? a : b;
              const longer = a.length < b.length ? b : a;
              if (shorter.length === 0) return 0;
              let matches = 0;
              for (let i = 0; i < shorter.length; i++) {
                if (shorter[i] === longer[i]) matches++;
              }
              return matches / longer.length;
            };

            const rawKelasLower = rawKelas.toLowerCase();
            const rawNormalized = normalize(rawKelas);
            
            // 1. Exact match
            let matchedKelas = kelasMaster.find(k => k.nama.toLowerCase() === rawKelasLower);
            
            // 2. Normalized exact match (tanpa "Kelas" dan tanda kurung)
            if (!matchedKelas) {
              matchedKelas = kelasMaster.find(k => normalize(k.nama) === rawNormalized);
            }

            // 3. Partial includes match
            if (!matchedKelas) {
              matchedKelas = kelasMaster.find(k => 
                k.nama.toLowerCase().includes(rawKelasLower) || 
                rawKelasLower.includes(k.nama.toLowerCase()) ||
                normalize(k.nama).includes(rawNormalized) ||
                rawNormalized.includes(normalize(k.nama))
              );
            }

            // 4. Fuzzy similarity match (>= 70% mirip setelah dinormalisasi)
            if (!matchedKelas) {
              let bestMatch: typeof kelasMaster[0] | null = null;
              let bestScore = 0;
              for (const k of kelasMaster) {
                const score = similarity(normalize(k.nama), rawNormalized);
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = k;
                }
              }
              if (bestMatch && bestScore >= 0.6) {
                matchedKelas = bestMatch;
              }
            }

            if (!matchedKelas) {
              isValid = false;
              errorMsg = `Kelas "${rawKelas}" tidak ditemukan di database. Kelas yang tersedia: ${kelasMaster.map(k => k.nama).join(', ')}`;
            } else {
              matchedKelasId = matchedKelas.id;
            }
          }

          return {
            index: idx + 2, // +2 because index 0 is row 2 in excel (header is row 1)
            nama: rawNama,
            kelas: rawKelas,
            kamar: rawKamar,
            tempat_lahir: rawTmpLahir,
            tanggal_lahir: rawTglLahir,
            alamat: rawAlamat,
            _isValid: isValid,
            _errorMsg: errorMsg,
            _kelasId: matchedKelasId
          };
        });

        setParsedData(parsed);
        setStep(2);
      } catch (err) {
        console.error(err);
        alert('Gagal membaca file Excel. Pastikan formatnya benar.');
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMulaiImport = async () => {
    setIsProcessing(true);
    
    let successCount = 0;
    const failedList: string[] = [];

    // Kumpulkan baris yang error dari awal
    const preFailedRows = parsedData.filter(r => !r._isValid);
    preFailedRows.forEach(r => failedList.push(`Baris ${r.index}: ${r.nama || 'Tanpa Nama'} - ${r._errorMsg}`));

    // Siapkan data yang valid
    const validRows = parsedData.filter(r => r._isValid);
    
    if (validRows.length > 0) {
      const payload = validRows.map(r => ({
        nama: r.nama,
        kelas_id: r._kelasId,
        kamar: r.kamar || null,
        tempat_lahir: r.tempat_lahir || null,
        tanggal_lahir: r.tanggal_lahir ? r.tanggal_lahir : null,
        alamat: r.alamat || null,
        status: 'aktif',
        tanggal_masuk: new Date().toISOString().split('T')[0] // default hari ini
      }));

      // Insert in chunks to avoid large payload limits if necessary, but Supabase can handle hundreds fine
      try {
        const { error } = await supabase.from('santri').insert(payload);
        if (error) {
          throw error;
        }
        successCount = validRows.length;
      } catch (error: any) {
        console.error('Batch insert failed:', error);
        failedList.push('Sistem Error: Gagal menyimpan data valid ke database (' + error.message + ')');
      }
    }

    setSummary({
      success: successCount,
      failed: parsedData.length - successCount,
      failedRows: failedList
    });
    
    setStep(3);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate('/santri')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Kembali ke Data Santri</span>
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h1 className="text-2xl font-bold text-gray-900">Import Massal Santri</h1>
            <p className="text-gray-500 mt-1">Unggah file Excel (.xlsx) untuk menambahkan banyak data santri sekaligus.</p>
          </div>

          <div className="p-6">
            {/* Stepper Indicator */}
            <div className="flex items-center justify-between mb-8 max-w-xl mx-auto">
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-khzm-green text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                <span className="text-xs mt-2 font-medium text-gray-600">Upload</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded-full ${step >= 2 ? 'bg-khzm-green' : 'bg-gray-200'}`}></div>
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-khzm-green text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                <span className="text-xs mt-2 font-medium text-gray-600">Preview & Validasi</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded-full ${step >= 3 ? 'bg-khzm-green' : 'bg-gray-200'}`}></div>
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-khzm-green text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                <span className="text-xs mt-2 font-medium text-gray-600">Selesai</span>
              </div>
            </div>

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
              <div className="max-w-2xl mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Pilih file Excel Anda</h3>
                  <p className="text-sm text-gray-500 mb-6">Format yang didukung hanya .xlsx (Microsoft Excel)</p>
                  
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm inline-flex items-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Pilih File Excel
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-3">Belum punya format kolom yang benar?</p>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="text-khzm-green hover:text-green-700 font-medium text-sm inline-flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download Template Kosong
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PREVIEW */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Preview Data</h3>
                    <p className="text-sm text-gray-500">
                      Total baris terbaca: <strong className="text-gray-900">{parsedData.length}</strong>. 
                      Sistem akan **otomatis melewati (*skip*)** baris yang error berwarna merah.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => setStep(1)}
                      className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-center"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleMulaiImport}
                      disabled={isProcessing || parsedData.filter(r => r._isValid).length === 0}
                      className="flex-1 sm:flex-none bg-khzm-green hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center text-sm disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Mulai Import Data
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="p-3 font-semibold text-gray-700 w-12 text-center">No</th>
                        <th className="p-3 font-semibold text-gray-700">Nama Lengkap</th>
                        <th className="p-3 font-semibold text-gray-700">Kelas</th>
                        <th className="p-3 font-semibold text-gray-700">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedData.map((row) => (
                        <tr key={row.index} className={row._isValid ? 'bg-white' : 'bg-red-50/50'}>
                          <td className="p-3 text-center text-gray-500">{row.index}</td>
                          <td className="p-3 font-medium text-gray-900">{row.nama || <span className="text-red-400 italic">Kosong</span>}</td>
                          <td className="p-3 text-gray-600">{row.kelas || <span className="text-red-400 italic">Kosong</span>}</td>
                          <td className="p-3">
                            {row._isValid ? (
                              <span className="inline-flex items-center text-xs font-medium text-green-700">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Valid (Siap simpan)
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium text-red-600">
                                <AlertTriangle className="h-3.5 w-3.5 mr-1 shrink-0" /> {row._errorMsg}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STEP 3: RESULT SUMMARY */}
            {step === 3 && (
              <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-8 w-8 text-khzm-green" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Selesai!</h2>
                  <p className="text-gray-600">Proses import data santri telah berakhir dengan hasil sebagai berikut:</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-green-50 rounded-xl p-6 text-center border border-green-100">
                    <span className="block text-4xl font-bold text-green-700 mb-1">{summary.success}</span>
                    <span className="text-sm font-medium text-green-800">Berhasil Disimpan</span>
                  </div>
                  <div className={`rounded-xl p-6 text-center border ${summary.failed > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <span className={`block text-4xl font-bold mb-1 ${summary.failed > 0 ? 'text-red-700' : 'text-gray-700'}`}>{summary.failed}</span>
                    <span className={`text-sm font-medium ${summary.failed > 0 ? 'text-red-800' : 'text-gray-600'}`}>Gagal / Di-skip</span>
                  </div>
                </div>

                {summary.failedRows.length > 0 && (
                  <div className="bg-white border border-red-100 rounded-xl overflow-hidden mb-8">
                    <div className="bg-red-50 px-4 py-3 border-b border-red-100">
                      <h3 className="font-semibold text-red-800 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2" /> Detail Kegagalan
                      </h3>
                    </div>
                    <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto p-4 bg-gray-50 text-sm font-mono">
                      {summary.failedRows.map((err, i) => (
                        <li key={i} className="py-2 text-red-600 leading-relaxed">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-center">
                  <button 
                    onClick={() => navigate('/santri')}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    Kembali ke Tabel Santri
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportSantri;
