export type SocialId = "vk" | "twitter" | "youtube";

export type SocialLink = {
  id: SocialId;
  label: string;
  href: string;
};

/** Official Topovik profiles from the legacy WordPress theme. */
export const SOCIAL_LINKS: SocialLink[] = [
  { id: "vk", label: "VK", href: "https://vk.com/topovik" },
  { id: "twitter", label: "Twitter", href: "https://twitter.com/topovikcom/" },
  {
    id: "youtube",
    label: "YouTube",
    href: "https://youtube.com/channel/UCRceG_bc_vGSBMhL459yiHg",
  },
];
