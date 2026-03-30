CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs rows are immutable and cannot be %', lower(TG_OP)
        USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_prevent_update ON "audit_logs";
CREATE TRIGGER audit_logs_prevent_update
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON "audit_logs";
CREATE TRIGGER audit_logs_prevent_delete
BEFORE DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();
