export class ResumenProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute() {
        return await this.nubeService.resumenProgramacion();
    }
}
