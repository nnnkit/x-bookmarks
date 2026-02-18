import { highlight } from "sugar-high";

interface Props {
  code: string;
}

export function CodeBlock({ code }: Props) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-x-card p-4 text-sm leading-relaxed font-mono break-inside-avoid">
      <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </pre>
  );
}
