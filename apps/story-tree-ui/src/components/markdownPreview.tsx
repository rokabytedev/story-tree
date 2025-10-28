type MarkdownPreviewProps = {
  content: string;
};

type MarkdownNode =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseMarkdown(content: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const lines = content.split(/\r?\n/);

  let buffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length) {
      nodes.push({
        type: "paragraph",
        text: buffer.join(" ").trim(),
      });
      buffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length) {
      nodes.push({
        type: "list",
        items: [...listBuffer],
      });
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length as 1 | 2 | 3;
      nodes.push({
        type: "heading",
        level,
        text: headingMatch[2],
      });
      continue;
    }

    const listMatch = line.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      continue;
    }

    buffer.push(line);
  }

  flushParagraph();
  flushList();

  return nodes;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const nodes = parseMarkdown(content);

  return (
    <div className="space-y-4 text-text-muted">
      {nodes.map((node, index) => {
        switch (node.type) {
          case "heading": {
            const HeadingTag = `h${node.level}` as const;
            const HeadingStyles: Record<number, string> = {
              1: "text-3xl font-semibold text-text-primary",
              2: "text-2xl font-semibold text-text-primary",
              3: "text-xl font-semibold text-text-primary",
            };
            return (
              <HeadingTag key={index} className={HeadingStyles[node.level]}>
                {node.text}
              </HeadingTag>
            );
          }
          case "list":
            return (
              <ul key={index} className="list-disc space-y-1 pl-6 text-sm">
                {node.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            );
          case "paragraph":
          default:
            return <p key={index}>{node.text}</p>;
        }
      })}
    </div>
  );
}
