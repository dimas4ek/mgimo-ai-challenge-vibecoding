import { type ResolveDiscussionReportInput, routes } from "@aihs/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { call, isApiError } from "../../api/client";

const reports = routes.staff.discussionReports;
const listKey = ["staff", "discussion-reports", "list"] as const;
const detailKey = (id: string) => ["staff", "discussion-reports", id] as const;

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
