import React from 'react';

const BayerLeverkusenLogo = (
    <svg role="img" viewBox="0 0 24 24" className="h-full w-full">
        <circle cx="12" cy="12" r="11.5" fill="white" stroke="black" strokeWidth="1"/>
        <path d="M 9.5 7 L 7 12 L 9.5 17 M 14.5 7 L 17 12 L 14.5 17" stroke="#E32220" strokeWidth="1.5" fill="none" />
        <path d="M 8.2 12 h 7.6" stroke="#E32220" strokeWidth="1.5" fill="none" />
        <text x="12" y="8" textAnchor="middle" fontSize="3" fontWeight="bold">BAYER</text>
        <text x="12" y="18.5" textAnchor="middle" fontSize="2.5" fontWeight="bold">LEVERKUSEN</text>
    </svg>
)

const logos: { [key: string]: React.ReactNode } = {
  'Bayer Leverkusen': BayerLeverkusenLogo,
  'VfL Bochum': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="#005ca9"/><text x="12" y="15" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">VfL</text></svg>,
  'AS Roma': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="#8B0029"/><text x="12" y="15" textAnchor="middle" fill="#FDB913" fontSize="6" fontWeight="bold">ASR</text></svg>,
  'Eintracht Frankfurt': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="black"/><path d="M12 4 L18 10 L16 20 L8 20 L6 10Z" fill="red" /></svg>,
  'FC Augsburg': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="white" stroke="red" strokeWidth="2"/><text x="12" y="15" textAnchor="middle" fill="green" fontSize="6" fontWeight="bold">FCA</text></svg>,
  'Borussia Dortmund': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="#FDE100"/><text x="12" y="15" textAnchor="middle" fill="black" fontSize="6" fontWeight="bold">BVB</text></svg>,
  'West Ham': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="#7A263A"/><text x="12" y="15" textAnchor="middle" fill="#86C2EE" fontSize="5" fontWeight="bold">WHU</text></svg>,
  'Default': <svg role="img" viewBox="0 0 24 24" className="h-full w-full"><circle cx="12" cy="12" r="10" fill="#ccc"/></svg>,
};

const TeamLogo = ({ teamName, className }: { teamName: string; className?: string }) => {
  const logo = logos[teamName] || logos['Default'];
  return <div className={className}>{logo}</div>;
};

export default TeamLogo;
