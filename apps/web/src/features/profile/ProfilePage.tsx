import { StubPage } from "../../app/StubPage";

/**
 * Профиль и выход. Наполняет задача #13.
 * Дисклеймер уже есть в подвале (телефон) и сайдбаре (десктоп) AppShell — второй раз не выводим.
 */
export function ProfilePage() {
  return <StubPage title="Профиль" task={13} />;
}
