import { useIntlDates } from "@keylearn/intl";
import {
  clearNgramStats,
  downloadBlob,
  exportFilename,
} from "@keylearn/pages-shared";
import { useResults } from "@keylearn/result";
import { Button, Field, FieldList, Icon } from "@keylearn/widget";
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
            defaultMessage:
              "Get a full export of your typing history as a JSON file.",
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
  const { results, clearResults, namespace, profileName } = useResults();
  const { formatStamp } = useIntlDates();
  return {
    handleDownloadData: () => {
      const json = JSON.stringify(results);
      const blob = new Blob([json], { type: "application/json" });
      // Named for whose history it is and when it was taken, so a folder of
      // these can be told apart — the old fixed name gave "typing-data (3)".
      downloadBlob(
        blob,
        exportFilename(
          "typing-data",
          profileName,
          "json",
          formatStamp(Date.now()),
        ),
      );
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
