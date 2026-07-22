import { useParams } from "wouter";
import { ProfileView } from "@/components/profile/ProfileView";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  return <ProfileView userId={Number(id)} />;
}
