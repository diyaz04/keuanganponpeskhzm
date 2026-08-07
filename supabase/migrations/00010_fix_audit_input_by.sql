CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_row_data JSONB;
BEGIN
    -- Coba ambil ID user menggunakan standar Supabase
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF v_user_id IS NULL THEN
        BEGIN
            v_user_id := (current_setting('request.jwt.claim.sub', true))::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
    END IF;

    -- Ambil data row yang dimodifikasi
    IF (TG_OP = 'DELETE') THEN
        v_row_data := row_to_json(OLD)::jsonb;
    ELSE
        v_row_data := row_to_json(NEW)::jsonb;
    END IF;

    -- JIKA V_USER_ID MASIH NULL (karena trigger context hilang), 
    -- kita coba ekstrak secara paksa dari kolom 'input_by' jika tabel tersebut memilikinya!
    IF v_user_id IS NULL AND v_row_data ? 'input_by' THEN
        BEGIN
            v_user_id := (v_row_data->>'input_by')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
    END IF;

    -- Eksekusi Insert ke Audit Log
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, v_row_data, v_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, v_row_data, v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, v_row_data, v_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
