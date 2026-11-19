import { useParams } from "react-router";
import { Disclaimer, Logo } from "../../app/brand";

/**
 * Справка для печати с QR, `/requests/:id/certificate`. Отдельная страница без AppShell,
 * чтобы печать была чистой; ссылку на неё даёт карточка готовой заявки. Наполняет #26.
 */
export function CertificatePage() {
  const { id } = useParams<"id">();
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Logo />
      <h1 className="text-2xl font-bold">Справка</h1>
      <p className="text-sm break-all text-muted-foreground">
        Печатная форма для заявки {id} появится в задаче #26.
      </p>
      <Disclaimer />
    </main>
  );
}
