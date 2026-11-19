import type { RequestStatus } from "@aihs/contract";
import { CircleCheck, CircleX, Hourglass, type LucideIcon, Send } from "lucide-react";
import { Badge } from "../../ui";
import { requestStatusView } from "./model";

type RequestStatusBadgeProps = { status: RequestStatus };

const statusIcon: Record<RequestStatus, LucideIcon> = {
  submitted: Send,
  in_review: Hourglass,
  ready: CircleCheck,
  rejected: CircleX,
};

/**
 * Бейдж статуса заявки: иконка и текст из `requestStatusView`, а не только цвет.
 * Используется в списке и карточке заявки (#16) и в очереди деканата (#18).
 */
export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const { label, tone } = requestStatusView(status);
  const Icon = statusIcon[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
