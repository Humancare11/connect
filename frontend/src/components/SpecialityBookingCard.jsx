import BookingCard from "./booking/BookingCard";

function SpecialityBookingCard({ priceInfo, categoryId, name, isPcp = false }) {
    const href = `/category-consultant?category=${categoryId}&specialty=${encodeURIComponent(name)}${isPcp ? "&pcp=1" : ""}`;
    return <BookingCard priceInfo={priceInfo} ctaHref={href} />;
}

export default SpecialityBookingCard;