import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SwapRequestWithOffers, OfferablePosition, SystemSettings } from '../types';

interface SwapRequestCardProps {
  swapRequest: SwapRequestWithOffers;
  settings: SystemSettings;
  onAccept: (swapRequestId: number, positionOfferedId: number) => Promise<void>;
  loading?: boolean;
}

// Helper za dobivanje kratkog naziva dana
const getShortDayName = (dayOfWeek: number): string => {
  const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
  return days[dayOfWeek] || '';
};

// Helper za parsiranje datuma i dobivanje dana u tjednu (0=Pon, 6=Ned)
const getDayOfWeekFromDate = (dateStr: string): number => {
  const date = new Date(dateStr);
  const jsDay = date.getDay(); // 0=Sun, 1=Mon, ...
  return jsDay === 0 ? 6 : jsDay - 1; // Konvertuj u 0=Mon, 6=Sun
};

// Helper za određivanje smjene
const getShiftType = (startTime: string, settings: SystemSettings): 'morning' | 'afternoon' => {
  const morningEnd = settings.weekday_morning_end || '12:00:00';
  return startTime < morningEnd ? 'morning' : 'afternoon';
};

// Helper za formatiranje datuma
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getDate()}.${date.getMonth() + 1}.`;
};

export default function SwapRequestCard({
  swapRequest,
  settings,
  onAccept,
  loading = false,
}: SwapRequestCardProps) {
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  const { swap_request, positions_can_offer } = swapRequest;
  const requestedPosition = swap_request.position_to_swap_details;
  
  // Generiraj strukturu za prikaz grida
  const gridData = useMemo(() => {
    const workdays = settings.workdays;
    
    // Za regularnu poziciju - prikaži radne dane tjedna
    const requestedDay = getDayOfWeekFromDate(requestedPosition.date);
    const requestedShift = getShiftType(requestedPosition.start_time, settings);
    
    // Grupiraj pozicije koje se mogu ponuditi po danu i smjeni
    const offerableByDayAndShift = new Map<string, OfferablePosition>();
    positions_can_offer.forEach(pos => {
      const day = getDayOfWeekFromDate(pos.date);
      const shift = getShiftType(pos.start_time, settings);
      offerableByDayAndShift.set(`${day}-${shift}`, pos);
    });
    
    return {
      workdays,
      requestedDay,
      requestedShift,
      requestedPosition,
      offerableByDayAndShift,
      isSpecialEvent: requestedPosition.is_special_event,
    };
  }, [requestedPosition, positions_can_offer, settings]);
  
  const handleAccept = async () => {
    if (!selectedPositionId) return;
    
    setIsAccepting(true);
    try {
      await onAccept(swap_request.id, selectedPositionId);
    } finally {
      setIsAccepting(false);
    }
  };
  
  const handleCellPress = (position: OfferablePosition | null) => {
    if (!position) return;
    setSelectedPositionId(prev => prev === position.id ? null : position.id);
  };
  
  // Render za regularnu poziciju (ne special event)
  const renderRegularGrid = () => {
    const { workdays, requestedDay, requestedShift, offerableByDayAndShift } = gridData;
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    
    return (
      <View style={styles.gridContainer}>
        {allDays.map(day => {
          const isWorkday = workdays.includes(day);
          
          if (!isWorkday) {
            return (
              <View key={day} style={styles.dayColumn}>
                <Text style={[styles.dayName, styles.dayNameInactive]}>{getShortDayName(day)}</Text>
              </View>
            );
          }
          
          const morningPos = offerableByDayAndShift.get(`${day}-morning`);
          const afternoonPos = offerableByDayAndShift.get(`${day}-afternoon`);
          
          const isMorningRequested = day === requestedDay && requestedShift === 'morning';
          const isAfternoonRequested = day === requestedDay && requestedShift === 'afternoon';
          
          return (
            <View key={day} style={styles.dayColumn}>
              <Text style={styles.dayName}>{getShortDayName(day)}</Text>
              
              {/* Jutarnja smjena */}
              <TouchableOpacity
                style={[
                  styles.shiftBox,
                  isMorningRequested && styles.requestedBox,
                  morningPos && styles.offerableBox,
                  morningPos && selectedPositionId === morningPos.id && styles.selectedBox,
                  !isMorningRequested && !morningPos && styles.emptyBox,
                ]}
                onPress={() => handleCellPress(morningPos || null)}
                disabled={!morningPos || loading}
              >
                {isMorningRequested && (
                  <Text style={styles.cellText} numberOfLines={2}>
                    {requestedPosition.exhibition_name}
                  </Text>
                )}
                {morningPos && !isMorningRequested && (
                  <Text style={styles.cellTextOfferable} numberOfLines={2}>
                    {morningPos.exhibition_name}
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Popodnevna smjena */}
              <TouchableOpacity
                style={[
                  styles.shiftBox,
                  isAfternoonRequested && styles.requestedBox,
                  afternoonPos && styles.offerableBox,
                  afternoonPos && selectedPositionId === afternoonPos.id && styles.selectedBox,
                  !isAfternoonRequested && !afternoonPos && styles.emptyBox,
                ]}
                onPress={() => handleCellPress(afternoonPos || null)}
                disabled={!afternoonPos || loading}
              >
                {isAfternoonRequested && (
                  <Text style={styles.cellText} numberOfLines={2}>
                    {requestedPosition.exhibition_name}
                  </Text>
                )}
                {afternoonPos && !isAfternoonRequested && (
                  <Text style={styles.cellTextOfferable} numberOfLines={2}>
                    {afternoonPos.exhibition_name}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };
  
  // Render za special event
  const renderSpecialEventGrid = () => {
    return (
      <View style={styles.specialEventContainer}>
        <Text style={styles.specialEventLabel}>Posebni događaj</Text>
        <View style={styles.specialEventGrid}>
          <View style={styles.specialEventDayColumn}>
            <Text style={styles.dayName}>{formatDate(requestedPosition.date)}</Text>
            <View style={[styles.shiftBox, styles.requestedBox, styles.specialEventBox]}>
              <Text style={styles.cellText} numberOfLines={2}>
                {requestedPosition.exhibition_name}
              </Text>
              <Text style={styles.eventTime}>
                {requestedPosition.start_time.slice(0, 5)} - {requestedPosition.end_time.slice(0, 5)}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Pozicije koje se mogu ponuditi */}
        {positions_can_offer.length > 0 && (
          <>
            <Text style={styles.offerLabel}>Možeš ponuditi:</Text>
            {renderRegularGrid()}
          </>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Zahtjev za zamjenu</Text>
        <Text style={styles.subtitle}>
          {swap_request.requesting_guard_name} traži zamjenu
        </Text>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.requestedBox]} />
          <Text style={styles.legendText}>Tražena pozicija</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.offerableBox]} />
          <Text style={styles.legendText}>Tvoje pozicije</Text>
        </View>
      </View>
      
      {/* Grid */}
      {gridData.isSpecialEvent ? renderSpecialEventGrid() : renderRegularGrid()}
      
      {/* Accept button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.acceptButton,
            (!selectedPositionId || loading) && styles.acceptButtonDisabled,
          ]}
          onPress={handleAccept}
          disabled={!selectedPositionId || loading || isAccepting}
        >
          {isAccepting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>
              {selectedPositionId ? 'Prihvati zamjenu' : 'Odaberi poziciju za zamjenu'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#D3968C',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A3323',
  },
  subtitle: {
    fontSize: 14,
    color: '#0A3323',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: '#0A3323',
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 38,
  },
  dayName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 4,
  },
  dayNameInactive: {
    color: '#D3968C',
  },
  shiftBox: {
    width: '100%',
    height: 36,
    borderRadius: 4,
    marginBottom: 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  emptyBox: {
    backgroundColor: '#0A3323',
  },
  requestedBox: {
    backgroundColor: '#D3968C',
  },
  offerableBox: {
    backgroundColor: '#A6C27A',
  },
  selectedBox: {
    backgroundColor: '#105666',
  },
  cellText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#F7F4D5',
    textAlign: 'center',
  },
  cellTextOfferable: {
    fontSize: 8,
    fontWeight: '500',
    color: '#105666',
    textAlign: 'center',
  },
  specialEventContainer: {
    marginTop: 8,
  },
  specialEventLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#105666',
    marginBottom: 8,
  },
  specialEventGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  specialEventDayColumn: {
    alignItems: 'center',
  },
  specialEventBox: {
    width: 80,
    height: 50,
    paddingVertical: 4,
  },
  eventTime: {
    fontSize: 7,
    color: '#F7F4D5',
    marginTop: 2,
  },
  offerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A3323',
    marginTop: 12,
    marginBottom: 8,
  },
  footer: {
    marginTop: 16,
  },
  acceptButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  acceptButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 14,
  },
});
