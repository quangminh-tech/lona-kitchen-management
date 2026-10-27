-- Design only, not connected to JSON runtime. Review before applying after 001.
BEGIN;
SET search_path=lona,public;
CREATE TABLE document_template(company_id uuid NOT NULL REFERENCES company,id uuid NOT NULL DEFAULT gen_random_uuid(),code text NOT NULL,name text NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(company_id,id),UNIQUE(company_id,code));
CREATE TABLE document_template_version(company_id uuid NOT NULL,template_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),definition jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES app_user,PRIMARY KEY(company_id,template_id,version),FOREIGN KEY(company_id,template_id) REFERENCES document_template(company_id,id));
CREATE TABLE issued_document(company_id uuid NOT NULL REFERENCES company,id uuid NOT NULL DEFAULT gen_random_uuid(),source_document_id uuid NOT NULL,source_version bigint NOT NULL,template_id uuid NOT NULL,template_version integer NOT NULL,template_snapshot jsonb NOT NULL,context_snapshot jsonb NOT NULL,content_sha256 text NOT NULL,issued_at timestamptz NOT NULL DEFAULT now(),issued_by uuid NOT NULL REFERENCES app_user,PRIMARY KEY(company_id,id),UNIQUE(company_id,source_document_id,source_version,template_id,template_version),FOREIGN KEY(company_id,source_document_id) REFERENCES stock_document(company_id,id),FOREIGN KEY(company_id,template_id,template_version) REFERENCES document_template_version(company_id,template_id,version));
CREATE TRIGGER immutable_template_version BEFORE UPDATE OR DELETE ON document_template_version FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER immutable_issued_document BEFORE UPDATE OR DELETE ON issued_document FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
COMMIT;
-- Add company RLS and warehouse-scoped access policy before deployment.
-- Server validates known variables and column keys, max lengths and layout limits.
-- No raw HTML, JavaScript, expressions, or remote resources in template definitions.
