"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

type Props = {
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    name?: string;
    required?: boolean;
};

function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function PdfDropzone({
    children,
    className = "",
    disabled = false,
    name = "document",
    required = false,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState("");

    function setSelectedFile(file: File | undefined) {
        if (!file) return;
        if (!isPdf(file)) {
            if (inputRef.current) inputRef.current.value = "";
            setFileName("");
            setError("Csak PDF számla tölthető fel.");
            return;
        }

        const input = inputRef.current;
        if (!input) return;

        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        setFileName(file.name);
        setError("");
    }

    function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
        setSelectedFile(event.target.files?.[0]);
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (!disabled) setSelectedFile(event.dataTransfer.files?.[0]);
    }

    return (
        <div
            className={`${className} pdf-dropzone${isDragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => {
                event.preventDefault();
                if (!disabled) setIsDragging(true);
            }}
            onDragOver={handleDragOver}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
            }}
            onDrop={handleDrop}
        >
            {children}
            <input
                ref={inputRef}
                name={name}
                type="file"
                accept="application/pdf"
                className="input"
                required={required}
                disabled={disabled}
                onChange={handleInputChange}
            />
            {fileName ? <div className="pdf-dropzone-file" aria-live="polite">Kiválasztva: {fileName}</div> : null}
            {error ? <div className="pdf-dropzone-error" role="alert">{error}</div> : null}
        </div>
    );
}
