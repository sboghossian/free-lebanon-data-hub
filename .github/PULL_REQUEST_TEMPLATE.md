## What changed

<!-- One event, source, dataset, translation or fix per pull request. -->

## Sources

<!-- A public link for every new or changed row. State which confidence tag you used and why. -->

## Checklist

- [ ] `python3 build/build_timeline.py` passes
- [ ] `python3 -m unittest discover -s build -p 'test_*.py'` passes
- [ ] `python3 tools/validate_research.py` passes
- [ ] New rows were appended, not inserted (rows are keyed by line)
- [ ] No private names, personal paths or keys
- [ ] New data states its licence, or `null` if the source states none
