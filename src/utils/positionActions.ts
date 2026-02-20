import { AssignmentPosition, PositionAction, SystemSettings, User, GuardUser } from '../types';
import { PeriodType } from '../hooks/usePeriodTimer';

export interface ActionInfo {
  action: PositionAction;
  label: string;
  color: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export interface PositionActionContext {
  position: AssignmentPosition;
  weekView: 'this-week' | 'next-week';
  currentPeriod: PeriodType;
  user: User;
  now?: Date;
}

/**
 * Provjerava da li je pozicija već počela ili prošla
 */
export const hasPositionStarted = (position: AssignmentPosition, now: Date = new Date()): boolean => {
  const positionDate = new Date(position.position.date);
  const [hours, minutes] = position.position.start_time.split(':').map(Number);
  positionDate.setHours(hours, minutes, 0, 0);
  
  return now >= positionDate;
};

/**
 * Provjerava da li pozicija počinje za manje od 1 sat
 */
export const isPositionStartingWithinHour = (position: AssignmentPosition, now: Date = new Date()): boolean => {
  const positionDate = new Date(position.position.date);
  const [hours, minutes] = position.position.start_time.split(':').map(Number);
  positionDate.setHours(hours, minutes, 0, 0);
  
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  // Pozicija je danas i počinje unutar sljedećih sat vremena
  return positionDate > now && positionDate <= oneHourFromNow;
};

/**
 * Provjerava da li je pozicija danas
 */
export const isPositionToday = (position: AssignmentPosition, now: Date = new Date()): boolean => {
  const positionDate = new Date(position.position.date);
  const today = new Date(now);
  
  return (
    positionDate.getFullYear() === today.getFullYear() &&
    positionDate.getMonth() === today.getMonth() &&
    positionDate.getDate() === today.getDate()
  );
};

/**
 * Provjerava da li je ulogirani guard upisan na poziciju
 */
export const isUserAssignedToPosition = (position: AssignmentPosition, user: User): boolean => {
  if (!position.guard) return false;
  if (user.role !== 'guard') return false;
  
  const guardUser = user as GuardUser;
  return position.guard.id === guardUser.guard_profile.id;
};

/**
 * Provjerava da li se na poziciju može kliknuti
 */
export const isPositionClickable = (context: PositionActionContext): boolean => {
  const { position, weekView, currentPeriod } = context;
  const now = context.now || new Date();
  
  // This week pozicija koja je već počela ili prošla - ne može se kliknuti
  if (weekView === 'this-week' && hasPositionStarted(position, now)) {
    return false;
  }
  
  // Next week u konfiguracijskom periodu - ne može se kliknuti
  if (weekView === 'next-week' && currentPeriod === 'config') {
    return false;
  }
  
  return true;
};

/**
 * Vraća listu dostupnih akcija za poziciju
 */
export const getAvailableActions = (context: PositionActionContext): ActionInfo[] => {
  const { position, weekView, currentPeriod, user } = context;
  const now = context.now || new Date();
  
  const actions: ActionInfo[] = [];
  
  // Guard mora biti ulogiran
  if (user.role !== 'guard') {
    return actions;
  }
  
  const isAssigned = isUserAssignedToPosition(position, user);
  const isTaken = position.is_taken;
  
  // ========================================
  // THIS WEEK LOGIKA
  // ========================================
  if (weekView === 'this-week') {
    // Ako je pozicija već počela ili prošla - nema akcija
    if (hasPositionStarted(position, now)) {
      return actions;
    }
    
    if (isAssigned) {
      // Guard je upisan na poziciju
      
      // Otkaži
      actions.push({
        action: 'cancel',
        label: 'Otkaži',
        color: '#D3968C',
      });
      
      // Zatraži zamjenu
      actions.push({
        action: 'request_swap',
        label: 'Zatraži zamjenu',
        color: '#105666',
      });
      
      // Otkaži više smjena
      actions.push({
        action: 'bulk_cancel',
        label: 'Otkaži više smjena',
        color: '#0A3323',
      });
      
      // Prijavi kašnjenje - samo ako je danas i počinje za sat ili manje
      if (isPositionToday(position, now) && isPositionStartingWithinHour(position, now)) {
        actions.push({
          action: 'report_lateness',
          label: 'Prijavi kašnjenje',
          color: '#839958',
        });
      }
    } else if (!isTaken) {
      // Nitko nije upisan
      actions.push({
        action: 'assign',
        label: 'Upiši se',
        color: '#839958',
      });
    } else {
      // Netko drugi je upisan
      actions.push({
        action: 'challenge',
        label: '⚔️ Izazovi na dvoboj',
        color: '#105666',
        disabled: false,
        disabledMessage: 'Nažalost, dvoboji trenutno nisu dozvoljeni.',
      });
    }
  }
  
  // ========================================
  // NEXT WEEK LOGIKA
  // ========================================
  if (weekView === 'next-week') {
    // U konfiguracijskom periodu - nema akcija
    if (currentPeriod === 'config') {
      return actions;
    }
    
    // U manualnom periodu
    if (currentPeriod === 'manual' || currentPeriod === 'grace') {
      if (isAssigned) {
        // Ispiši se (cancel s drugim labelom)
        actions.push({
          action: 'unassign',
          label: 'Ispiši se',
          color: '#D3968C',
        });
      } else if (!isTaken) {
        // Upiši se
        actions.push({
          action: 'assign',
          label: 'Upiši se',
          color: '#839958',
        });
      } else {
        // Netko drugi je upisan
        actions.push({
          action: 'challenge',
          label: 'Izazovi na dvoboj za poziciju',
          color: '#105666',
          disabled: true,
          disabledMessage: 'Nažalost, dvoboji trenutno nisu dozvoljeni.',
        });
      }
    }
    
    // Završio manualni period (off period) - next week postaje kao this week
    if (currentPeriod === 'off') {
      if (isAssigned) {
        // Otkaži
        actions.push({
          action: 'cancel',
          label: 'Otkaži',
          color: '#D3968C',
        });
        
        // Zatraži zamjenu
        actions.push({
          action: 'request_swap',
          label: 'Zatraži zamjenu',
          color: '#105666',
        });
        
        // Otkaži više smjena
        actions.push({
          action: 'bulk_cancel',
          label: 'Otkaži više smjena',
          color: '#0A3323',
        });
      } else if (!isTaken) {
        // Nitko nije upisan
        actions.push({
          action: 'assign',
          label: 'Upiši se',
          color: '#839958',
        });
      } else {
        // Netko drugi je upisan
        actions.push({
          action: 'challenge',
          label: '⚔️ Izazovi na dvoboj',
          color: '#105666',
          disabled: false,
          disabledMessage: 'Nažalost, dvoboji trenutno nisu dozvoljeni.',
        });
      }
    }
  }
  
  return actions;
};

/**
 * Label za action info modal title
 */
export const getActionModalTitle = (position: AssignmentPosition): string => {
  const { exhibition_name, date, start_time, end_time } = position.position;
  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;
  const formattedTime = `${start_time.slice(0, 5)} - ${end_time.slice(0, 5)}`;
  
  return `${exhibition_name}\n${formattedDate} ${formattedTime}`;
};
