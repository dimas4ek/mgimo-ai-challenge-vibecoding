import { Disclaimer } from "../../app/brand";
import { StubPage } from "../../app/StubPage";

/** Профиль и выход. Наполняет задача #13; дисклеймер должен остаться. */
export function ProfilePage() {
  return (
    <StubPage title="Профиль" task={13}>
      <Disclaimer className="mt-6" />
    </StubPage>
  );
}
