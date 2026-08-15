import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ProfileView } from "@/components/profile/ProfileView";
import { useAuth } from "@/context/AuthContext";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const profileId = Number(id);
  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (isOwnProfile) navigate("/profile/me", { replace: true });
  }, [isOwnProfile, navigate]);

  if (isOwnProfile) {
    return <div className="py-20 text-center text-sm text-muted-foreground" role="status">Opening your profile&hellip;</div>;
  }

  return <ProfileView userId={profileId} />;
}
