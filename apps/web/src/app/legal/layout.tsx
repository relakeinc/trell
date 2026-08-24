import { LegalLayout } from "@/components/LegalLayout";

export const metadata = {
  title: {
    template: "%s – Trell",
    default: "Legal – Trell",
  },
};

export default function LegalLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <LegalLayout>{children}</LegalLayout>;
}
