import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { useLogout } from "../../api/hooks";
import { paths } from "../../app/paths";
import { Button, type ButtonProps } from "../../ui";

/** Выход: сессия удаляется на сервере, кэш чистится, переход на экран входа. */
export function LogoutButton(props: Omit<ButtonProps, "onClick" | "children">) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      {...props}
      disabled={logout.isPending}
      onClick={() =>
        logout.mutate(undefined, { onSettled: () => navigate(paths.login, { replace: true }) })
      }
    >
      <LogOut aria-hidden />
      {logout.isPending ? "Выходим…" : "Выйти"}
    </Button>
  );
}
