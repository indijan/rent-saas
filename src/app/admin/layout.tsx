import PrivateLayout from "@/components/PrivateLayout";

type Props = {
    children: React.ReactNode;
};

export default function AdminLayout({ children }: Props) {
    return <PrivateLayout>{children}</PrivateLayout>;
}
