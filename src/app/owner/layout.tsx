import PrivateLayout from "@/components/PrivateLayout";

type Props = {
    children: React.ReactNode;
};

export default function OwnerLayout({ children }: Props) {
    return <PrivateLayout>{children}</PrivateLayout>;
}
