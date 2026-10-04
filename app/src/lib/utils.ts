import { createCn } from "cn/config"

// The type scale in globals.css adds font sizes the merger doesn't know:
// without this, `text-body` would be read as a colour and drop `text-primary-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "title", "heading", "body", "small", "micro"] }],
    },
  },
})
