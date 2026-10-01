import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import type { PublicProfile } from "@/shared/dto";

export const usePublicProfile = (id: string) =>
  useQuery({
    queryKey: qk.user(id),
    queryFn: ({ signal }) => api.get<PublicProfile>(`/api/users/${id}`, signal),
    retry: false,
  });
