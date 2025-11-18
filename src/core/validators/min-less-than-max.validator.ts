import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function minLessThanMaxValidator(minField: string, maxField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const min = group.get(minField)?.value;
    const max = group.get(maxField)?.value;

    if (min != null && max != null && max <= min) {
      return { minGreaterThanMax: true };
    }

    return null;
  };
}
