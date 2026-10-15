import { LanguageSwitcher } from "@/components/platform/language-switcher";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="absolute right-4 top-4 z-10"><LanguageSwitcher /></div>
      {children}
    </>
  );
}
