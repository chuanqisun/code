## Image to JSONL

```
convert my calendar to jsonl, remove all day events. Use this format

{ name: "...", start: ..., duration: ... }. Duration should be in unitless hours, e.g. "1", "1.5" Start should be "YYYYMMDDHHMM"

example:

{"name": "Movie Night", "time": {"start": "202608311830", "duration": "1"}}
{"name": "Swim", "time": {"start": "202609011000", "duration": "1"}}
```

## JSONL Availibity table

```
Write a program to find free time in my schedule. Requirement:
At least 1.5 hours long
Has at least 0.5 hour buffer to prev. next. events
Within 9am - 9pm
If a day doesn't appear, it is fully free
Any weekend days between the first and last event should be included

The program should printout a formated plaintext list of free time ranges

Example format:
"""
Fri, Sep 4, 2026
  9 AM – 4:30 PM
  7:30 PM – 9 PM

Sat, Sep 5, 2026
  9 AM – 9 PM
"""
```