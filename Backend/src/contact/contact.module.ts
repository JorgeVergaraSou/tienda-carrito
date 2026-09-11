import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactSettingsEntity } from './entities/contact-settings.entity';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactSettingsEntity])],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
