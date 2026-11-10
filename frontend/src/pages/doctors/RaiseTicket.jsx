import MySupportTickets from "../../components/support/MySupportTickets";
import { DOCTOR_CATEGORIES } from "../../components/support/supportCategories";

// Doctor "My Support Tickets". The conversation UI is shared with the patient page.
const RaiseTicket = () => <MySupportTickets role="doctor" categories={DOCTOR_CATEGORIES} />;

export default RaiseTicket;
