import MySupportTickets from "../../components/support/MySupportTickets";
import { PATIENT_CATEGORIES } from "../../components/support/supportCategories";
import { notifyUserActivityUpdated } from "../../utils/activityEvents";

// Patient "My Support Tickets". The conversation UI is shared with the doctor page.
export default function UserRaiseTicket() {
  return (
    <MySupportTickets
      role="patient"
      categories={PATIENT_CATEGORIES}
      onCreated={(ticket) => notifyUserActivityUpdated({ source: "ticket", id: ticket?._id })}
    />
  );
}
