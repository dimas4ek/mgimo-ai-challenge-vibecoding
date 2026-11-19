// Единственный способ фронта получать данные (.claude/rules/frontend-ui.md). Импорты из apps/api запрещены.
export { ApiClientError, api, call, isApiError } from "./client";
export {
  createQueryClient,
  queryKeys,
  useChangeRequestStatus,
  useCreateRequest,
  useDemoReset,
  useGrades,
  useLogin,
  useLogout,
  useMarkRead,
  useMe,
  useNotifications,
  useProfile,
  useRequest,
  useRequests,
  useSchedule,
  useStaffRequests,
} from "./hooks";
