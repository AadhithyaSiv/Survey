# A study on how we decide

An interactive research survey (single static page) that collects decision-making
data and streams each completed response into a Google Sheet via a Google Apps
Script Web App.

- **The survey:** [`index.html`](index.html)
- **The collector:** [`apps-script/Code.gs`](apps-script/Code.gs) (deployed as a Google Apps Script Web App)
- **Full setup / deployment steps:** [`DEPLOY.md`](DEPLOY.md)

Responses are written one row per respondent to a sheet named **Responses**,
with each question stored as its own (human-readable) column. The endpoint the
survey posts to is set in `CONFIG.endpoint` inside the HTML file.

Researcher: Jyoti Sharma, School of Liberal Arts, IIT Jodhpur.
