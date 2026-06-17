#!/usr/bin/env python3
"""Restructure Timesheet.jsx to have fixed header + scrollable table"""
with open("src/pages/employees/Timesheet.jsx", "r") as f:
    lines = f.readlines()

# Find key lines
outer_frag_open = None  # line with "<>"
inner_frag_open = None  # second "<>" for the loading: section
table_open = None       # line with '<div className="product-table">'
inner_frag_close = None # line with "</>" that closes inner fragment (before modal)
outer_frag_close = None # last "</>"

for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped == "<>":
        if outer_frag_open is None:
            outer_frag_open = i
        elif inner_frag_open is None:
            inner_frag_open = i
    if '<div className="product-table">' in line:
        table_open = i
    if stripped == "</>" and i > inner_frag_open:
        if inner_frag_close is None:
            inner_frag_close = i
        else:
            outer_frag_close = i

print(f"outer_frag_open: {outer_frag_open}")
print(f"inner_frag_open: {inner_frag_open}")
print(f"table_open: {table_open}")
print(f"inner_frag_close: {inner_frag_close}")
print(f"outer_frag_close: {outer_frag_close}")

# Make changes
# 1. Outer fragment -> flex container
lines[outer_frag_open] = lines[outer_frag_open].replace(
    "<>",
    '<div style={{display:\'flex\',flexDirection:\'column\',height:\'100%\',minHeight:0}}>\n      <div style={{flexShrink:0}}>'
)

# 2. Inner fragment close (before modal) -> close flexShrink div too
lines[inner_frag_close] = lines[inner_frag_close].replace("</>", "</div>\n        </div>")

# 3. Table div: remove from inside loading, add as scrollable
# Move the line after </> close (inner_frag_close) to after the table
# Actually, the table is BETWEEN inner_frag_open and inner_frag_close.
# We need to close flexShrink BEFORE the table, and move the table AFTER the </>

# This is getting complex. Let's take a different approach.
# Just wrap the header content in flexShrink, and close it before the table.

print("\nStructure found. Now making targeted edits...")

# Find the end of the filter bar section - it's right before the table comment
filter_end = None
for i in range(table_open - 5, table_open):
    if "stock-filterbar" in lines[i] and "</div>" in lines[i]:
        filter_end = i

print(f"filter_end near table: checking...")

# Just check if we can find the right closing
for i in range(table_open - 10, table_open):
    line = lines[i].rstrip()
    print(f"  line {i}: {line}")
