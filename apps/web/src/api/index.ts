// Единственный способ фронта получать данные (.claude/rules/frontend-ui.md). Импорты из apps/api запрещены.
export { ApiClientError, api, call, isApiError, retryHint } from "./client";
export {
  createQueryClient,
  queryKeys,
  useCertificate,
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
  useVerification,
} from "./hooks";
