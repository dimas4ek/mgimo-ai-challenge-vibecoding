import { useParams } from "react-router";
import { StubPage } from "../../app/StubPage";

/** Карточка заявки с историей статусов, `/requests/:id`. Наполняет задача #16. */
export function RequestPage() {
  const { id } = useParams<"id">();
  return (
    <StubPage title="Заявка" task={16}>
      <p className="mt-3 text-sm break-all text-muted-foreground">id: {id}</p>
    </StubPage>
  );
}
