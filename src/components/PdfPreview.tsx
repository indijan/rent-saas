"use client";

import { useEffect, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Props = {
    url: string;
};

export default function PdfPreview({ url }: Props) {
    const [pageImages, setPageImages] = useState<string[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function renderPdf() {
            setLoading(true);
            setError("");
            setPageImages([]);

            try {
                const loadingTask = getDocument(url);
                const pdf = await loadingTask.promise;
                const renderedPages: string[] = [];

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                    const page = await pdf.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");

                    if (!context) {
                        throw new Error("A PDF előnézet renderelése nem sikerült.");
                    }

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({
                        canvas,
                        canvasContext: context,
                        viewport,
                    }).promise;

                    renderedPages.push(canvas.toDataURL("image/png"));
                }

                if (!cancelled) {
                    setPageImages(renderedPages);
                }
            } catch {
                if (!cancelled) {
                    setError("A PDF előnézet itt nem érhető el. Nyisd meg külön a PDF-et.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void renderPdf();

        return () => {
            cancelled = true;
        };
    }, [url]);

    if (loading) {
        return <p className="muted-note">PDF előnézet betöltése...</p>;
    }

    if (error) {
        return <p className="muted-note">{error}</p>;
    }

    return (
        <div className="document-preview-pages">
            {pageImages.map((pageImage, index) => (
                <img
                    key={`${index + 1}-${pageImage.slice(0, 24)}`}
                    src={pageImage}
                    alt={`PDF oldal ${index + 1}`}
                    className="document-preview-image"
                />
            ))}
        </div>
    );
}
