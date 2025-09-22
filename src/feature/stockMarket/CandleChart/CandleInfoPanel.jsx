const CandleInfoPanel = ({ candle }) => {
    if (!candle) return (
        <div className="h-8 flex items-center text-xs text-gray-500">
            Hover over a candle to see details
        </div>
    );

    const dateFormat = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    // Calculate percentage change
    const percentChange = ((candle.close - candle.open) / candle.open) * 100;
    const changeColor = percentChange >= 0 ? "green" : "red";
    const changePrefix = percentChange >= 0 ? "+" : "";

    return (
        <div className="h-8 flex items-center text-xs overflow-x-auto whitespace-nowrap">
            <span className="font-semibold mr-2">
                Date: {dateFormat.format(new Date(candle.timestamp))}
            </span>
            <span className="mr-2">Open: {candle.open.toFixed(2)}</span>
            <span className="mr-2">High: {candle.high.toFixed(2)}</span>
            <span className="mr-2">Low: {candle.low.toFixed(2)}</span>
            <span className="mr-2">Close: {candle.close.toFixed(2)}</span>
            <span className="mr-2">Volume: {candle.volume.toFixed(0)}</span>
            <span style={{ color: changeColor }} className="font-semibold">
                Change: {changePrefix}{percentChange.toFixed(2)}%
            </span>
        </div>
    );
};

export default CandleInfoPanel;
