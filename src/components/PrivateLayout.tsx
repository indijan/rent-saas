import { Suspense } from "react";
import RouteTransitionOverlay from "@/components/RouteTransitionOverlay";

type Props = {
    children: React.ReactNode;
};

export default function PrivateLayout({ children }: Props) {
    return (
        <div className="private-skin">
            {children}
            <Suspense fallback={null}>
                <RouteTransitionOverlay />
            </Suspense>
        </div>
    );
}
