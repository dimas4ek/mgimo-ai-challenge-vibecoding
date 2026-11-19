import type { RequestStatus } from "@aihs/contract";

type RequestStatusBadgeProps = { status: RequestStatus };

/**
 * Бейдж статуса заявки: иконка и текст из `requestStatusView`, а не только цвет.
 * Используется в списке и карточке заявки (#16) и в очереди деканата (#18).
 */
export function RequestStatusBadge(_props: RequestStatusBadgeProps): React.ReactNode {
  throw new Error("not implemented");
}
