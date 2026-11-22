import {
  type CreateDiscussionCommentInput,
  type CreateDiscussionInput,
  type CreateDiscussionReportInput,
  type DiscussionScope,
  routes,
} from "@aihs/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { call } from "../../api/client";

const http = routes.me.discussions;
const listKey = (scope: DiscussionScope) => ["discussions", "list", scope] as const;
const topicKey = (id: string) => ["discussions", "topic", id] as const;

export function useDiscussions(scope: DiscussionScope) {
  return useQuery({
    queryKey: listKey(scope),
    queryFn: ({ signal }) => call(http.list, { query: { scope }, signal }),
  });
}

export function useDiscussion(id: string) {
  return useQuery({
    queryKey: topicKey(id),
    queryFn: ({ signal }) => call(http.get, { params: { id }, signal }),
  });
}

export function useCreateDiscussion() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDiscussionInput) => call(http.create, { body }),
    onSuccess: (topic) => {
      cache.setQueryData(topicKey(topic.id), topic);
      void cache.invalidateQueries({ queryKey: listKey(topic.scope) });
    },
  });
}

export function useAddDiscussionComment(id: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDiscussionCommentInput) =>
      call(http.comment, { body, params: { id } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: topicKey(id) }),
  });
}

export function useReportDiscussionComment(commentId: string) {
  return useMutation({
    mutationFn: (body: CreateDiscussionReportInput) =>
      call(http.report, { body, params: { commentId } }),
  });
}
