---
name: Python JSX Block Replacement — Closing Tag Ambiguity
description: How to safely replace multi-line JSX blocks with Python when multiple elements share the same indentation level
type: feedback
originSessionId: 3ad0574f-f1b9-4617-8372-bae221188f58
---
When replacing a JSX block using Python `content.find(end_marker, start)`, a vague end marker like `'          </View>'` will find the WRONG tag if the block contains conditional JSX that renders nested `</View>` at the same indent.

**Why:** In dashboard.tsx, the legendRow replacement used `content.find('          </View>', ls)` to find the legendRow's closing tag. The first 10-space `</View>` after `ls` WAS the correct legendRow close — but after inserting the NEW legend (which also ends with `          </View>`), the old legend's remaining items were left as orphaned content below it. The script succeeded (printed "OK") but didn't remove the tail of the old block.

**How to apply:** Always use a LONGER, unique end marker that includes content IMMEDIATELY AFTER the closing tag. Examples:

```python
# WRONG — too short, finds wrong </View>
le = content.find('          </View>', ls)

# RIGHT — unique because nothing else precedes </Card.Content> in that context
le = content.find('          </View>\n        </Card.Content>', ls)
# Then: legend_end = le + len('          </View>')  ← keep </Card.Content> in output
```

Alternatively: match the ENTIRE old block as a string literal and use `content.replace(old_block, new_block, 1)`. This is the most reliable approach when the old content is stable — but requires an exact character-for-character match.

**Spot-check rule:** After every multi-block Python replacement, always run `sed -n "N,Mp"` on the modified area to visually verify the result before building or committing.
