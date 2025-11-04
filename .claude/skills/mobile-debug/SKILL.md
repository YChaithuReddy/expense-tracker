---
name: mobile-debug
description: Debug mobile view alignment issues by inspecting CSS, responsive breakpoints, and layout problems when the user mentions mobile layout issues, mobile view problems, alignment on mobile, or responsive design bugs
---

# Mobile View Debugging Skill

This skill helps identify and diagnose mobile view alignment and layout issues in the expense tracker application.

## When to Use

Use this skill when the user mentions:
- Mobile view problems
- Alignment issues on mobile devices
- Responsive design bugs
- Layout breaking on small screens
- Elements overlapping on mobile
- Buttons or content misaligned on mobile

## What This Skill Does

1. **Inspects Component Styles**: Examines CSS files for responsive breakpoints and mobile-specific styles
2. **Identifies Layout Issues**: Looks for common mobile layout problems like:
   - Fixed widths that don't scale
   - Missing media queries
   - Incorrect flexbox/grid configurations
   - Padding/margin issues on mobile
   - Z-index stacking problems
   - Overflow issues
   - Button sizing and positioning

3. **Checks Responsive Breakpoints**: Verifies that appropriate media queries exist for mobile devices (typically `@media (max-width: 768px)` and `@media (max-width: 480px)`)

4. **Analyzes Recent Changes**: Reviews recent git commits related to mobile fixes to understand what issues were previously addressed

## Debugging Checklist

When debugging mobile issues, check:

- [ ] Are there appropriate mobile media queries?
- [ ] Do fixed widths prevent proper scaling?
- [ ] Are padding/margins too large for small screens?
- [ ] Are buttons and action areas properly sized for touch?
- [ ] Is content overflowing containers?
- [ ] Are flex/grid layouts responsive?
- [ ] Is z-index causing elements to overlap incorrectly?
- [ ] Are font sizes readable on mobile?
- [ ] Is the modal taking full width on mobile?
- [ ] Are buttons positioned correctly at the bottom?

## Common Mobile Issues in This App

Based on recent commits, common issues include:
- Modal button alignment at the bottom
- Vendor input field sizing
- Batch review modal spacing
- Action button positioning
- Stats container layout on small screens

## Output

Provide a detailed report including:
1. Files with potential mobile issues
2. Specific CSS rules that need attention
3. Missing or inadequate media queries
4. Recommended fixes with line numbers
