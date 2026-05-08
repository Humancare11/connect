import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

const WordReveal = ({ text = "", className, active = false }) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  const controls = useAnimation();

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const word = {
    hidden: {
      opacity: 0.4,
      y: 6,
      color: "#94a3b8",
    },
    show: {
      opacity: 1,
      y: 0,
      color: "#1a1a1a",
      // transition: {
      //   duration: 0.4,
      //   ease: "easeOut",
      // },
    },
  };

  useEffect(() => {
    if (active) controls.start("show");
    else controls.set("hidden");
  }, [active, controls]);

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      animate={controls}
      style={{
        display: "block",
        lineHeight: "1.6",
      }}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          variants={word}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap", // 🔥 prevents word breaking
            marginRight: "0.3em",
          }}
        >
          {w}
        </motion.span>
      ))}
    </motion.div>
  );
};

export default WordReveal;
