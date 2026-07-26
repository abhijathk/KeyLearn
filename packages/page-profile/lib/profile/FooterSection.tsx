import { clearNgramStats } from "@keybr/pages-shared";
import { useResults } from "@keybr/result";
import { Button, Field, FieldList, Icon } from "@keybr/widget";
import { mdiDeleteForever, mdiDownload } from "@mdi/js";
import { useIntl } from "react-intl";

export function FooterSection() {
  const { formatMessage } = useIntl();
  const { handleDownloadData, handleResetData } = useCommands();

  return (
    <FieldList>
      <Field>
        <Button
          size={16}
          icon={<Icon shape={mdiDownload} />}
          label={formatMessage({
            id: "t_Download_data",
            defaultMessage: "Export your data",
          })}
          title={formatMessage({
            id: "profile.download.description",
            defaultMessage: "Get a full export of your typing history as a JSON file.",
          })}
          onClick={() => {
            handleDownloadData();
          }}
        />
      </Field>
      <Field.Filler />
      <Field>
        <Button
          size={16}
          icon={<Icon shape={mdiDeleteForever} />}
          label={formatMessage({
            id: "t_Reset_statistics",
            defaultMessage: "Clear statistics",
          })}
          title={formatMessage({
            id: "profile.reset.description",
            defaultMessage:
              "Wipes your typing history for good and resets every statistic.",
          })}
          onClick={() => {
            handleResetData();
          }}
        />
      </Field>
    </FieldList>
  );
}

function useCommands() {
  const { formatMessage } = useIntl();
  const { results, clearResults, namespace } = useResults();
  return {
    handleDownloadData: () => {
      const json = JSON.stringify(results);
      const blob = new Blob([json], { type: "application/json" });
      download(blob, "typing-data.json");
    },
    handleResetData: () => {
      const message = formatMessage({
        id: "profile.reset.message",
        defaultMessage:
          "Do you really want to erase all your data and reset your profile? " +
          "This can't be undone once you confirm!",
      });
      if (window.confirm(message)) {
        clearResults();
        // The n-gram weakness data (the "slowest transitions") lives in its
        // own per-profile store — wipe the displayed profile's along with the
        // typing history.
        clearNgramStats(namespace);
      }
    },
  };
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.setAttribute("href", URL.createObjectURL(blob));
  a.setAttribute("download", name);
  a.setAttribute("hidden", "");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
