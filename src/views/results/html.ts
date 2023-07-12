import { Webview } from "vscode";
import { head } from "../html";

export function setLoadingText(webview: Webview, text: string) {
  webview.postMessage({
    command: `loadingText`,
    text,
  });
}

export function getLoadingHTML(): string {
  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        ${head}
        <script>
          window.addEventListener("message", (event) => {
            const command = event.data.command;
            switch (command) {
              case "loadingText":
                const text = document.getElementById("loadingText");
                text.innerText = event.data.text;
                break;
            }
          });
        </script>
      </head>
      <body>
        <p id="loadingText">Loading..</p>
        <section class="loading">
          <p><vscode-progress-ring></vscode-progress-ring></p>
        </section>
      </body>
    </html>
  `;
}

export function generateScroller(basicSelect: string, isCL: boolean): string {
  return /*html*/`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        ${head}
        <script>
          const vscode = acquireVsCodeApi();
          const basicSelect = ${JSON.stringify(basicSelect)};
          let myQueryId = '';
          
          let mustLoadHeaders = true;
          let totalRows = 0;
          let noMoreRows = false;
          let isFetching = false;
          let columnList = [];

          window.addEventListener("load", main);
            function main() {
              let Observer = new IntersectionObserver(function(entries) {
              // isIntersecting is true when element and viewport are overlapping
              // isIntersecting is false when element and viewport don't overlap
              if(entries[0].isIntersecting === true) {
                if (isFetching === false && noMoreRows === false) {
                  fetchNextPage();
                }
              }
            }, { threshold: [0] });

            Observer.observe(document.getElementById("nextButton"));


            window.addEventListener('message', event => {
              const data = event.data;
              
              switch (data.command) {
                case 'metadata':
                  // TODO: get backend to give us header metadata
                  // columnList = data.columnList;
                  // setHeaders('resultset', data.columnList)
                  mustLoadHeaders = false;
                  break;

                case 'rows':
                  // Change loading state here...
                  isFetching = false;
                  myQueryId = data.queryId;
                  noMoreRows = data.isDone;

                  // HACK: right now, we build the column list from the first row keys... bad

                  if (mustLoadHeaders && data.rows.length > 0) {
                    columnList = Object.keys(data.rows[0]);
                    
                    setHeaders('resultset', columnList);

                    mustLoadHeaders = false;
                  }

                  if (data.rows.length > 0) {
                    totalRows += data.rows.length;
                    appendRows('resultset', columnList, data.rows);
                  }

                  const nextButton = document.getElementById("nextButton");
                  nextButton.innerText = noMoreRows ? ('Loaded ' + totalRows + '. End of data') : ('Loaded ' + totalRows + '. Fetching more...');
                  break;

                case 'fetch':
                  // Set loading here....
                  fetchNextPage();
                  break;
              }
            });
          }

          function fetchNextPage() {
            isFetching = true;
            vscode.postMessage({
              query: basicSelect,
              isCL: ${isCL},
              queryId: myQueryId
            });
          }

          function setHeaders(tableId, columns) {
            var tHeadRef = document.getElementById(tableId).getElementsByTagName('thead')[0];
            tHeadRef.innerHTML = '';

            // Insert a row at the end of table
            var newRow = tHeadRef.insertRow();

            columns.forEach(colName => {
              // Insert a cell at the end of the row
              var newCell = newRow.insertCell();

              // Append a text node to the cell
              var newText = document.createTextNode(colName);
              newCell.appendChild(newText);
            });
          }

          function appendRows(tableId, colList, arrayOfObjects) {
            var tBodyRef = document.getElementById(tableId).getElementsByTagName('tbody')[0];

            for (const row of arrayOfObjects) {
              // Insert a row at the end of table
              var newRow = tBodyRef.insertRow();

              for (const columnName of colList) {
                // Insert a cell at the end of the row
                var newCell = newRow.insertCell();

                // Append a text node to the cell
                var newText = document.createTextNode(row[columnName] || 'null');
                newCell.appendChild(newText);
              }
            }

          }
        </script>
      </head>
      <body>
        <table id="resultset">
          <thead></thead>
          <tbody></tbody>
        </table>
        <p id="nextButton">Execute statement.</p>
      </body>
    </html>
  `;
}

interface ColumnDetail {title: string, columnDataKey: string|number, transform?: (row: object) => string|number};
