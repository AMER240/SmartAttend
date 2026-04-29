# `frontend/pages/`

This folder is reserved for Streamlit's optional [multi-page apps](https://docs.streamlit.io/library/get-started/multipage-apps) feature.

The current single-file dashboard (`frontend/app.py`) already exposes every
view via the sidebar radio. If you prefer Streamlit's native multipage layout
(one `.py` file = one page in the sidebar), simply move the `page_*` functions
out of `app.py` into individual files here, e.g.:

```
frontend/pages/1_👤_Students.py
frontend/pages/2_📚_Courses.py
frontend/pages/3_▶️_Sessions.py
frontend/pages/4_📷_Live_Attendance.py
frontend/pages/5_📊_Reports.py
```

Streamlit will pick them up automatically when you run
`streamlit run frontend/app.py`.
