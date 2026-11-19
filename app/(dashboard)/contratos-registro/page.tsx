import { buttonClass } from "@/components/ui/Button";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note } from "@/components/ui/PanelKit";
import { requireContractsStaff } from "@/features/contracts/lib/access.server";
import { refreshRegistrationSignaturesAction } from "@/features/contracts/actions";
import {
  RegistrationContractsTable,
  type RegistrationContractView,
} from "@/features/contracts/components/RegistrationContractsTable.client";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RegistrationContractRow {
  id: string;
  email: string;
  legal_name: string;
  party_type: "natural" | "company";
  doc_type: "dni" | "ruc";
  doc_number: string;
  status: string;
  external_ref: string | null;
  signed_at: string | null;
  signed_storage_path: string | null;
  checkout_returned_at: string | null;
  payment_proof_status: string | null;
  payment_proof_path: string | null;
  payment_proof_reason: string | null;
  created_at: string;
}

const createdFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function RegistrationContractsPage() {
  await requireContractsStaff();
  const admin = createAdminClient();
  const loaded = await admin
    .from("client_service_contracts")
    .select(
      "id, email, legal_name, party_type, doc_type, doc_number, status, external_ref, signed_at, signed_storage_path, checkout_returned_at, payment_proof_status, payment_proof_path, payment_proof_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  const rows: RegistrationContractView[] = loaded.error
    ? []
    : await Promise.all(
        ((loaded.data ?? []) as RegistrationContractRow[]).map(async (row) => ({
          id: row.id,
          legalName: row.legal_name,
          email: row.email,
          company: row.party_type === "company",
          document: `${row.doc_type.toUpperCase()} ${row.doc_number}`,
          createdLabel: createdFormat.format(new Date(row.created_at)),
          sent: Boolean(row.external_ref),
          status: row.status,
          signedPdfUrl: row.signed_storage_path ? await signedPdfUrl(row.signed_storage_path) : null,
          proofStatus: row.payment_proof_status,
          proofReason: row.payment_proof_reason,
          proofUrl: row.payment_proof_path ? await signedPdfUrl(row.payment_proof_path) : null,
          returnedFromCheckout: Boolean(row.checkout_returned_at),
        })),
      );

  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Contratos de registro"
        lede="El contrato de registro y el de reunión usan el mismo FirmEasy. Aquí ves si se avisó, si firmó y si la captura del pago ya abre el panel."
        actions={
          <form action={refreshRegistrationSignaturesAction}>
            <button type="submit" className={buttonClass("outline")}>
              <PanelIcon name="refresh" />
              Actualizar firmas
            </button>
          </form>
        }
      />
      {loaded.error ? (
        <Note tone="danger" title="No se pudo cargar la lista">
          Aplica las migraciones 046, 047, 048 y 049.
        </Note>
      ) : rows.length === 0 ? (
        <PanelCard>
          <EmptyState
            icon="contract"
            title="Todavía no hay contratos de registro"
            description="Cuando un cliente nuevo reciba su contrato, aparecerá aquí con el estado de su firma."
          />
        </PanelCard>
      ) : (
        <RegistrationContractsTable rows={rows} />
      )}
    </>
  );
}

async function signedPdfUrl(path: string): Promise<string> {
  const signed = await createAdminClient().storage.from("registration-contracts").createSignedUrl(path, 60 * 10);
  return signed.data?.signedUrl ?? "#";
}
