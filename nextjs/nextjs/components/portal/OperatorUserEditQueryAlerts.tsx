import { FlashToastsBoundary } from "@/components/FlashToasts";
import { OPERATOR_USER_EDIT_FLASH_STRIP, operatorUserEditFlashItems } from "@/lib/urlFlashToasts";

/** URL flash → Sonner on manager / reseller / dealer subscriber edit pages. */
export function OperatorUserEditQueryAlerts(props: {
  ok?: string;
  error?: string;
  bal?: string;
  req?: string;
  max?: string;
  renew_acc?: string;
}) {
  const items = operatorUserEditFlashItems(props);
  return items.length ? (
    <FlashToastsBoundary items={items} stripParams={[...OPERATOR_USER_EDIT_FLASH_STRIP]} />
  ) : null;
}
