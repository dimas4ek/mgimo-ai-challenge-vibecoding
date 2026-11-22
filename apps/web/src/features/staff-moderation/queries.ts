import {
  type ResolveDiscussionReportInput,
  routes,
  type StaffDiscussionReport,
} from "@aihs/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { call, isApiError } from "../../api/client";

const reports = routes.staff.discussionReports;
const listKey = ["staff", "discussion-reports", "list"] as const;
const details = ["staff", "discussion-reports", "detail"] as const;
const detailKey = (id: string) => [...details, id] as const;

export function useStaffComplaints() {
  return useQuery({ queryKey: listKey, queryFn: ({ signal }) => call(reports.list, { signal }) });
}

export function useStaffComplaint(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => call(reports.get, { params: { id }, signal }),
  });
}

export function useResolveStaffComplaint(id: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: ResolveDiscussionReportInput) =>
      call(reports.resolve, { body, params: { id } }),
    onSuccess: (report) => {
      cache.setQueryData(detailKey(id), report);
      if (report.status === "hidden") {
        // Сервер также закрывает другие открытые жалобы на этот комментарий.
        for (const [key, sibling] of cache.getQueriesData<StaffDiscussionReport>({
          queryKey: details,
        })) {
          if (sibling?.commentId === report.commentId && sibling.id !== report.id) {
            cache.removeQueries({ queryKey: key, exact: true });
          }
        }
      }
      void cache.invalidateQueries({ queryKey: listKey });
    },
    onError: (error) => {
      if (isApiError(error, 409)) {
        void cache.invalidateQueries({ queryKey: detailKey(id) });
        void cache.invalidateQueries({ queryKey: listKey });
      }
    },
  });
}
